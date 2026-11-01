package app.couchtv.launcher

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.Settings

/** The TV's quick controls (Wi-Fi, Bluetooth, ad blocking, memory) that need the system, shared by the home and TV tools. */
object Quick {
    fun dnsHost(c: Context): String? {
        val mode = Settings.Global.getString(c.contentResolver, "private_dns_mode")
        val host = Settings.Global.getString(c.contentResolver, "private_dns_specifier")
        return if (mode == "hostname" && !host.isNullOrBlank()) host else null
    }

    /** host null = off. Returns false when Android refuses (the one-time permission is missing). */
    fun setDns(c: Context, host: String?): Boolean = try {
        if (host == null) {
            Settings.Global.putString(c.contentResolver, "private_dns_mode", "opportunistic")
        } else {
            Settings.Global.putString(c.contentResolver, "private_dns_specifier", host)
            Settings.Global.putString(c.contentResolver, "private_dns_mode", "hostname")
        }
        true
    } catch (e: SecurityException) {
        false
    }

    fun vpnOn(c: Context): Boolean {
        val cm = c.getSystemService(ConnectivityManager::class.java) ?: return false
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
    }
}
