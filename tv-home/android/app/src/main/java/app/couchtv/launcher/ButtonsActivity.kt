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
    private lateinit var cleanRow: View
    private val ui = android.os.Handler(android.os.Looper.getMainLooper())

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
        list.addView(row("TV tools", null).apply { textSize = 28f })
        val mem = Cleaner.mem(this)
        list.addView(note("Memory: ${mem.freeMb} MB free of ${mem.totalMb} MB"))
        cleanRow = row("Close all apps and free memory") { clean() }
        list.addView(cleanRow)
        list.addView(row("Buttons", null).apply { textSize = 22f })
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
        cleanRow.requestFocus()
    }

    private fun clean() {
        val before = Cleaner.mem(this).freeMb
        val n = Cleaner.closeAll(this)
        Toast.makeText(this, "Closing $n apps...", Toast.LENGTH_SHORT).show()
        ui.postDelayed({
            val after = Cleaner.mem(this).freeMb
            Toast.makeText(this, "Memory free: $before MB to $after MB", Toast.LENGTH_LONG).show()
            render()
        }, 1500)
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

    private val blocked get() = Buttons.blocked
    private var learnDialog: AlertDialog? = null
    private var learnWatch: android.content.SharedPreferences.OnSharedPreferenceChangeListener? = null

    private fun stopLearning() {
        val p = Buttons.prefs(this)
        p.edit().putLong("learnAt", 0).apply()
        learnWatch?.let { p.unregisterOnSharedPreferenceChangeListener(it) }
        learnWatch = null
    }

    private fun learn() {
        val p = Buttons.prefs(this)
        p.edit().putLong("learnAt", System.currentTimeMillis()).apply()
        // With the accessibility service on, it reports the press (Sony's own keys never reach the dialog).
        learnWatch = android.content.SharedPreferences.OnSharedPreferenceChangeListener { sp, k ->
            if (k == "learned") {
                val parts = (sp.getString("learned", "") ?: "").split(",")
                val scan = parts.getOrNull(0)?.toIntOrNull() ?: 0
                val key = parts.getOrNull(1)?.toIntOrNull() ?: return@OnSharedPreferenceChangeListener
                runOnUiThread {
                    stopLearning()
                    learnDialog?.dismiss()
                    chooseAction(scan, key, Buttons.nameOf(key, scan))
                }
            }
        }
        p.registerOnSharedPreferenceChangeListener(learnWatch)
        val d = AlertDialog.Builder(this, AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            .setTitle("Press the remote button")
            .setMessage("Press the button you want to change. Back cancels.")
            .setOnCancelListener { stopLearning() }
            .create()
        learnDialog = d
        d.setOnKeyListener { dlg, keyCode, ev ->
            if (keyCode == KeyEvent.KEYCODE_BACK) return@setOnKeyListener false
            if (ev.action == KeyEvent.ACTION_DOWN && ev.repeatCount == 0) {
                if (keyCode in blocked) {
                    Toast.makeText(this, "That button is needed to use the TV. Pick another one.", Toast.LENGTH_LONG).show()
                } else {
                    stopLearning()
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
            .setItems(arrayOf("Open an app", "Go to Home", "Go Back", "Close all apps (free memory)", "Do nothing")) { _, which ->
                when (which) {
                    0 -> chooseApp(scan, key, name)
                    1 -> save(Buttons.Map(scan, key, name, "home", "", "Go to Home"))
                    2 -> save(Buttons.Map(scan, key, name, "back", "", "Go Back"))
                    3 -> save(Buttons.Map(scan, key, name, "clean", "", "Close all apps"))
                    4 -> save(Buttons.Map(scan, key, name, "none", "", "Do nothing"))
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
