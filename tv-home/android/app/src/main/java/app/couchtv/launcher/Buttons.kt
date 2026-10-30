package app.couchtv.launcher

import android.content.Context
import android.view.KeyEvent
import org.json.JSONArray
import org.json.JSONObject

/** The remote button changes the household has made. Kept in this app's private storage. */
object Buttons {
    /** type: app, home, back or none. arg: the package for app. scan is the remote's own code (0 if unknown). */
    data class Map(val scan: Int, val key: Int, val name: String, val type: String, val arg: String, val label: String)

    fun prefs(c: Context) = c.getSharedPreferences("buttons", Context.MODE_PRIVATE)

    fun load(c: Context): MutableList<Map> {
        val out = mutableListOf<Map>()
        try {
            val a = JSONArray(prefs(c).getString("maps", "[]"))
            for (i in 0 until a.length()) {
                val o = a.getJSONObject(i)
                out.add(Map(o.optInt("scan"), o.optInt("key"), o.optString("name"), o.optString("type"),
                    o.optString("arg"), o.optString("label")))
            }
        } catch (e: Exception) {}
        return out
    }

    fun save(c: Context, list: List<Map>) {
        val a = JSONArray()
        for (m in list) a.put(JSONObject().put("scan", m.scan).put("key", m.key).put("name", m.name)
            .put("type", m.type).put("arg", m.arg).put("label", m.label))
        prefs(c).edit().putString("maps", a.toString()).apply()
    }

    fun same(m: Map, scan: Int, key: Int) = if (m.scan != 0 && scan != 0) m.scan == scan else m.key == key

    fun find(list: List<Map>, e: KeyEvent): Map? = list.firstOrNull { same(it, e.scanCode, e.keyCode) }

    fun upsert(c: Context, m: Map) {
        val list = load(c)
        list.removeAll { same(it, m.scan, m.key) }
        list.add(m)
        save(c, list)
    }

    fun remove(c: Context, m: Map) {
        val list = load(c)
        list.removeAll { same(it, m.scan, m.key) }
        save(c, list)
    }

    /** While the setup screen is waiting for a button press, the service must let the press through. */
    fun learning(c: Context) = System.currentTimeMillis() - prefs(c).getLong("learnAt", 0) < 60000

    /** Keys the TV needs to be usable: never remapped. */
    val blocked = setOf(KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_DPAD_LEFT,
        KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_BACK,
        KeyEvent.KEYCODE_POWER, KeyEvent.KEYCODE_HOME)

    fun nameOf(keyCode: Int, scan: Int): String =
        KeyEvent.keyCodeToString(keyCode).removePrefix("KEYCODE_").replace('_', ' ').lowercase()
            .replaceFirstChar { it.uppercase() } + if (scan != 0) " (code $scan)" else ""
}
