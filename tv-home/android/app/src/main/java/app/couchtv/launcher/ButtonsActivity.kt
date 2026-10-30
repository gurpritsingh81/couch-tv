package app.couchtv.launcher

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/** Button remap: press a remote button, then choose what it does. Works with the remote alone. */
class ButtonsActivity : Activity() {

    private lateinit var list: LinearLayout

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val sv = ScrollView(this).apply { setBackgroundColor(0xFF0B0B0F.toInt()); isFillViewport = true }
        list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(80), dp(48), dp(80), dp(48))
        }
        sv.addView(list)
        setContentView(sv)
    }

    override fun onResume() {
        super.onResume()
        Buttons.prefs(this).edit().putLong("learnAt", 0).apply()
        render()
    }

    private fun serviceOn(): Boolean {
        val s = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        return s.contains("$packageName/") && s.contains("ButtonService")
    }

    private fun row(text: String, onClick: (() -> Unit)?): TextView = TextView(this).apply {
        this.text = text
        textSize = 18f
        setTextColor(Color.WHITE)
        setPadding(dp(20), dp(14), dp(20), dp(14))
        if (onClick != null) {
            isFocusable = true
            isClickable = true
            background = StateListDrawable().apply {
                addState(intArrayOf(android.R.attr.state_focused), ColorDrawable(0x55FFFFFF))
                addState(intArrayOf(), ColorDrawable(0x14FFFFFF))
            }
            setOnClickListener { onClick() }
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) }
    }

    private fun note(text: String) = row(text, null).apply { textSize = 14f; setTextColor(0xFFB0B0B8.toInt()) }

    private fun render() {
        list.removeAllViews()
        list.addView(row("Button remap", null).apply { textSize = 28f })
        val on = serviceOn()
        list.addView(note(if (on) "Everywhere: ON. Changes work inside every app."
            else "Everywhere: OFF. Changes only work after you switch it on once from a computer or phone (command at the bottom)."))
        val maps = Buttons.load(this)
        for (m in maps) {
            list.addView(row("${m.name}\n  now: ${m.label}") { editOne(m) })
        }
        list.addView(row("+ Change another button") { learn() }.apply { requestFocus() })
        if (!on) {
            list.addView(note("Run once in Termux:\n" +
                "adb shell settings put secure enabled_accessibility_services $packageName/$packageName.ButtonService\n" +
                "adb shell settings put secure accessibility_enabled 1"))
        }
        list.getChildAt(list.childCount - (if (on) 1 else 2)).requestFocus()
    }

    private fun editOne(m: Buttons.Map) {
        AlertDialog.Builder(this, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle(m.name)
            .setItems(arrayOf("Change what it does", "Put it back to normal", "Cancel")) { _, which ->
                when (which) {
                    0 -> chooseAction(m.scan, m.key, m.name)
                    1 -> { Buttons.remove(this, m); render() }
                }
            }.show()
    }

    private val blocked = setOf(KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_DPAD_LEFT,
        KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_BACK,
        KeyEvent.KEYCODE_POWER, KeyEvent.KEYCODE_HOME)

    private fun learn() {
        Buttons.prefs(this).edit().putLong("learnAt", System.currentTimeMillis()).apply()
        val d = AlertDialog.Builder(this, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle("Press the remote button")
            .setMessage("Press the button you want to change. Back cancels.")
            .setOnCancelListener { Buttons.prefs(this).edit().putLong("learnAt", 0).apply() }
            .create()
        d.setOnKeyListener { dlg, keyCode, ev ->
            if (keyCode == KeyEvent.KEYCODE_BACK) return@setOnKeyListener false
            if (ev.action == KeyEvent.ACTION_DOWN && ev.repeatCount == 0) {
                if (keyCode in blocked) {
                    Toast.makeText(this, "That button is needed to use the TV. Pick another one.", Toast.LENGTH_LONG).show()
                } else {
                    Buttons.prefs(this).edit().putLong("learnAt", 0).apply()
                    dlg.dismiss()
                    chooseAction(ev.scanCode, keyCode, Buttons.nameOf(keyCode, ev.scanCode))
                }
            }
            true
        }
        d.show()
    }

    private fun chooseAction(scan: Int, key: Int, name: String) {
        AlertDialog.Builder(this, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle("$name should")
            .setItems(arrayOf("Open an app", "Go to Home", "Go Back", "Do nothing")) { _, which ->
                when (which) {
                    0 -> chooseApp(scan, key, name)
                    1 -> save(Buttons.Map(scan, key, name, "home", "", "Go to Home"))
                    2 -> save(Buttons.Map(scan, key, name, "back", "", "Go Back"))
                    3 -> save(Buttons.Map(scan, key, name, "none", "", "Do nothing"))
                }
            }.show()
    }

    private fun chooseApp(scan: Int, key: Int, name: String) {
        val pm = packageManager
        val apps = pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER), 0)
            .filter { it.activityInfo.packageName != packageName }
            .map { it.loadLabel(pm).toString() to it.activityInfo.packageName }
            .distinctBy { it.second }
            .sortedBy { it.first.lowercase() }
        if (apps.isEmpty()) { Toast.makeText(this, "No apps found.", Toast.LENGTH_LONG).show(); return }
        AlertDialog.Builder(this, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle("Open which app?")
            .setItems(apps.map { it.first }.toTypedArray()) { _, i ->
                save(Buttons.Map(scan, key, name, "app", apps[i].second, "Open " + apps[i].first))
            }.show()
    }

    private fun save(m: Buttons.Map) {
        Buttons.upsert(this, m)
        render()
    }
}
