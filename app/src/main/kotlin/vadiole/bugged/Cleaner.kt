package vadiole.bugged

import java.net.URLDecoder

class Cleaner(rules: String, redirects: String) {
    private class Params(names: List<String>) {
        private val exact = names.filterNot { it.endsWith('*') }.toSet()
        private val prefixes = names.filter { it.endsWith('*') }.map { it.dropLast(1) }

        fun matches(name: String) = name in exact || prefixes.any { name.startsWith(it) }
    }

    private class Wrapper(val host: String, val path: String, val params: List<String>)

    private val params: Map<String, Params> = rules.lineSequence()
        .map { it.trim().lowercase().split(' ') }
        .filter { it.size > 1 }
        .associate { it[0] to Params(it.drop(1)) }

    private val wrappers: List<Wrapper> = redirects.lineSequence()
        .map { it.trim().split(' ') }
        .filter { it.size > 1 }
        .map {
            val target = it[0]
            val slash = target.indexOf('/')
            Wrapper(
                host = (if (slash < 0) target else target.substring(0, slash)).lowercase(),
                path = if (slash < 0) "/" else target.substring(slash),
                params = it.drop(1),
            )
        }
        .toList()

    fun cleanText(text: String): String = LINK.replace(text) {
        val link = it.value.trimEnd(*TRAILING)
        clean(link) + it.value.substring(link.length)
    }

    fun cleanHtml(html: String): String = LINK.replace(html) {
        val link = it.value.trimEnd(*TRAILING)
        clean(link.replace("&amp;", "&")).replace("&", "&amp;") + it.value.substring(link.length)
    }

    fun clean(url: String): String = clean(url, 0)

    private fun clean(url: String, depth: Int): String {
        val schemeEnd = url.indexOf("://")
        if (schemeEnd < 0 || !url.startsWith("http", ignoreCase = true)) return url
        val hashAt = url.indexOf('#').let { if (it < 0) url.length else it }
        val fragment = url.substring(hashAt)
        val queryAt = url.indexOf('?').let { if (it < 0 || it > hashAt) hashAt else it }
        val base = url.substring(0, queryAt)
        val query = if (queryAt < hashAt) url.substring(queryAt + 1, hashAt) else ""
        val pathAt = base.indexOf('/', schemeEnd + 3).let { if (it < 0) base.length else it }
        val host = base.substring(schemeEnd + 3, pathAt)
            .substringAfterLast('@')
            .substringBefore(':')
            .lowercase()
        val path = base.substring(pathAt).ifEmpty { "/" }
        val pairs = if (query.isEmpty()) emptyList() else query.split('&')

        if (depth < MAX_DEPTH) {
            val wrapper = wrappers.firstOrNull { covers(it.host, host) && path.startsWith(it.path) }
            if (wrapper != null) {
                for (name in wrapper.params) {
                    val value = pairs.firstOrNull { it.substringBefore('=') == name }?.substringAfter('=', "")
                    val target = value?.let(::decode)
                    if (target != null && SCHEME.containsMatchIn(target)) {
                        return clean(target, depth + 1)
                    }
                }
            }
        }

        if (pairs.isEmpty()) return url
        val active = buildList {
            params["*"]?.let(::add)
            var suffix = host
            while (true) {
                params[suffix]?.let(::add)
                val dot = suffix.indexOf('.')
                if (dot < 0) break
                suffix = suffix.substring(dot + 1)
            }
        }
        val tracked = pairs.filter { pair ->
            val raw = pair.substringBefore('=')
            val name = (decode(raw) ?: raw).lowercase()
            active.any { it.matches(name) }
        }
        if (tracked.isEmpty()) return url
        val kept = pairs.filter { it.isNotEmpty() && it !in tracked }
        return buildString {
            append(base)
            if (kept.isNotEmpty()) append('?').append(kept.joinToString("&"))
            append(fragment)
        }
    }

    private fun covers(rule: String, host: String) = host == rule || host.endsWith(".$rule")

    private fun decode(value: String): String? = try {
        URLDecoder.decode(value.replace("+", "%2B"), "UTF-8")
    } catch (_: IllegalArgumentException) {
        null
    }

    private companion object {
        const val MAX_DEPTH = 5
        val SCHEME = Regex("^https?://", RegexOption.IGNORE_CASE)
        val LINK = Regex("""https?://[^\s<>"]+""", RegexOption.IGNORE_CASE)
        val TRAILING = charArrayOf('.', ',', ';', ':', '!', '?', ')', ']', '}', '\'')
    }
}
