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

    /**
     * Closes the background processes of every app you installed (plus updated apps such as YouTube).
     * It leaves Home, the TV's own system apps and the app you are using alone. Returns how many apps it asked.
     */
    fun closeAll(c: Context): Int {
        val am = c.getSystemService(ActivityManager::class.java)
        val pm = c.packageManager
        val q = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
        val pkgs = pm.queryIntentActivities(q, 0).map { it.activityInfo.packageName }.toSet()
            .filter { it != c.packageName }
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
