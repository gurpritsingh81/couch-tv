package app.couchtv.launcher

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo

/** Frees memory by asking Android to close the background apps (the apps with a TV icon). */
object Cleaner {
    data class Mem(val freeMb: Long, val totalMb: Long)

    fun mem(c: Context): Mem {
        val am = c.getSystemService(ActivityManager::class.java)
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        return Mem(mi.availMem / 1048576, mi.totalMem / 1048576)
    }

    /** Apps the cleaner never closes: VPNs (it could drop the connection) and the phone remote app. */
    private val KEEP = setOf("dev.couchtv.ontv", "com.surfshark.vpnclient.android")
    private fun protectedApp(pkg: String) = pkg in KEEP || pkg.contains("vpn", ignoreCase = true)

    /**
     * Closes the background processes of every app you installed (plus updated apps such as YouTube).
     * It leaves Home, the TV's own system apps, VPNs, the phone remote app and the app you are using alone. Returns how many apps it asked.
     */
    fun closeAll(c: Context): Int {
        val am = c.getSystemService(ActivityManager::class.java)
        val pm = c.packageManager
        val q = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
        val pkgs = pm.queryIntentActivities(q, 0).map { it.activityInfo.packageName }.toSet()
            .filter { it != c.packageName }
            .filter { !protectedApp(it) }
            .filter { p ->
                try {
                    val f = pm.getApplicationInfo(p, 0).flags
                    (f and ApplicationInfo.FLAG_SYSTEM) == 0 || (f and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
                } catch (e: Exception) { false }
            }
        for (p in pkgs) try { am.killBackgroundProcesses(p) } catch (e: Exception) {}
        return pkgs.size
    }
}
