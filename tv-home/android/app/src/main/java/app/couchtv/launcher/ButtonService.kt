package app.couchtv.launcher

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

/**
 * Sees remote button presses before any app does, and swaps the ones the household has changed.
 * It does not read the screen: the accessibility events are ignored.
 */
class ButtonService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}

    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (Buttons.learning(this)) {
            // Setup is waiting for a press. Catch it here, before Sony's own handler can, and hand it over.
            if (event.keyCode in Buttons.blocked) return false
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                Buttons.prefs(this).edit().putString("learned", "${event.scanCode},${event.keyCode},${System.nanoTime()}").apply()
            }
            return true
        }
        val m = Buttons.find(Buttons.load(this), event) ?: return false
        // act once per press (not on key repeat), and swallow the release too
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) act(m)
        return true
    }

    private fun act(m: Buttons.Map) {
        when (m.type) {
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "clean" -> {
                // go Home first so the app you were in is in the background too, then close everything
                performGlobalAction(GLOBAL_ACTION_HOME)
                val h = android.os.Handler(android.os.Looper.getMainLooper())
                val before = Cleaner.mem(this).freeMb
                h.postDelayed({
                    Cleaner.closeAll(this)
                    h.postDelayed({
                        android.widget.Toast.makeText(this,
                            "Memory free: $before MB to ${Cleaner.mem(this).freeMb} MB", android.widget.Toast.LENGTH_LONG).show()
                    }, 1500)
                }, 700)
            }
            "app" -> {
                val i = packageManager.getLeanbackLaunchIntentForPackage(m.arg)
                    ?: packageManager.getLaunchIntentForPackage(m.arg)
                if (i != null) {
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    try { startActivity(i) } catch (e: Exception) {}
                }
            }
            else -> {}   // "none": the button does nothing
        }
    }
}
