package vadiole.bugged

import java.net.URLDecoder
import java.util.Collections
import java.util.regex.Pattern

class Cleaner(rules: String, redirects: String) {
    private class Params(names: List<String>) {
        private val exact = names.filterNotTo(HashSet()) { it.endsWith('*') }
        private val prefixes = names.filter { it.endsWith('*') }.map { it.dropLast(1) }

        fun matches(name: String) = name in exact || prefixes.any { name.startsWith(it) }
    }

    private class Wrapper(val order: Int, val path: String, val params: List<String>)

    class Cleaned(val text: String, val links: Int)

    private val params = HashMap<String, Params>()
    private val wrappers = HashMap<String, MutableList<Wrapper>>()

    init {
        val shared = HashMap<String, Params>()
        lines(rules) { line ->
            val space = line.indexOf(' ')
            if (space > 0) {
                val names = line.substring(space + 1).lowercase()
                params[line.substring(0, space).lowercase()] = shared.getOrPut(names) { Params(names.splitBy(' ')) }
            }
        }
        var order = 0
        lines(redirects) { line ->
            val parts = line.splitBy(' ')
            if (parts.size > 1) {
                val target = parts[0]
                val slash = target.indexOf('/')
                val host = (if (slash < 0) target else target.substring(0, slash)).lowercase()
                val path = if (slash < 0) "/" else target.substring(slash)
                wrappers.getOrPut(host) { ArrayList(1) }.add(Wrapper(order++, path, parts.subList(1, parts.size)))
            }
        }
    }

    fun cleanText(text: String): String = cleanLinks(text).text

    fun cleanLinks(text: String): Cleaned {
        if ("://" !in text) return Cleaned(text, 0)
        var links = 0
        val cleaned = replaceLinks(text) {
            val link = it.trimEnd(*TRAILING)
            val clean = clean(link)
            if (clean != link) links++
            clean + it.substring(link.length)
        }
        return Cleaned(cleaned, links)
    }

    fun cleanHtml(html: String): String {
        if ("://" !in html) return html
        return replaceLinks(html) {
            val link = it.trimEnd(*TRAILING)
            clean(link.replace("&amp;", "&")).replace("&", "&amp;") + it.substring(link.length)
        }
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
        val pairs = if (query.isEmpty()) Collections.emptyList() else query.splitBy('&')

        if (depth < MAX_DEPTH) {
            for (wrapper in candidates(host)) {
                if (!path.startsWith(wrapper.path)) continue
                val rest = path.substring(wrapper.path.length)
                for (name in wrapper.params) {
                    val target = when (name) {
                        QUERY -> if (hasScheme(query)) query + fragment else decode(query)
                        SEGMENT -> rest.splitBy('/').firstNotNullOfOrNull { part -> decode(part)?.takeIf(::hasScheme) }
                        SEGMENT_HTTPS -> bare(decode(rest.substringBefore('/')))?.let { "https://$it" }
                        SEGMENT_HTTP -> bare(decode(rest.substringBefore('/')))?.let { "http://$it" }
                        REST -> embedded(rest, url.substring(queryAt))
                        REST_HTTPS -> bare(rest)?.let { "https://$it" + url.substring(queryAt) }
                        else -> pairs.firstOrNull { it.substringBefore('=') == name }?.substringAfter('=', "")?.let(::decode)
                    }
                    if (target != null && hasScheme(target)) {
                        return clean(target, depth + 1)
                    }
                }
            }
        }

        if (pairs.isEmpty()) return url
        val active = ArrayList<Params>()
        params["*"]?.let(active::add)
        var suffix = host
        while (true) {
            params[suffix]?.let(active::add)
            val dot = suffix.indexOf('.')
            if (dot < 0) break
            suffix = suffix.substring(dot + 1)
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

    private fun bare(value: String?): String? = value?.takeIf { HOST.matcher(it).find() }

    private fun embedded(rest: String, tail: String): String? {
        var at = 0
        while (at < rest.length) {
            if (rest.startsWith("http", at, ignoreCase = true)) {
                val raw = rest.substring(at)
                if (hasScheme(raw)) return raw + tail
                val decoded = decode(raw)
                if (decoded != null && hasScheme(decoded)) return decoded
            }
            val next = rest.indexOf('/', at)
            if (next < 0) break
            at = next + 1
        }
        return null
    }

    private fun candidates(host: String): List<Wrapper> {
        var found: List<Wrapper> = Collections.emptyList()
        var suffix = host
        while (true) {
            wrappers[suffix]?.let { found = if (found.isEmpty()) it else ArrayList(found).apply { addAll(it); sortBy(Wrapper::order) } }
            val dot = suffix.indexOf('.')
            if (dot < 0) break
            suffix = suffix.substring(dot + 1)
        }
        return found
    }

    private fun hasScheme(value: String) =
        value.startsWith("http://", ignoreCase = true) || value.startsWith("https://", ignoreCase = true)

    private fun decode(value: String): String? {
        if ('%' !in value) return value
        return try {
            URLDecoder.decode(value.replace("+", "%2B"), "UTF-8")
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private inline fun replaceLinks(text: String, transform: (String) -> String): String {
        val matcher = LINK.matcher(text)
        if (!matcher.find()) return text
        val result = StringBuilder(text.length)
        var at = 0
        do {
            result.append(text, at, matcher.start()).append(transform(matcher.group()))
            at = matcher.end()
        } while (matcher.find())
        return result.append(text, at, text.length).toString()
    }

    private inline fun lines(text: String, block: (String) -> Unit) {
        var at = 0
        while (at < text.length) {
            val end = text.indexOf('\n', at).let { if (it < 0) text.length else it }
            val line = text.substring(at, end).trim()
            if (line.isNotEmpty()) block(line)
            at = end + 1
        }
    }

    private companion object {
        const val MAX_DEPTH = 5
        const val QUERY = ":query"
        const val SEGMENT = ":segment"
        const val SEGMENT_HTTPS = ":segment-https"
        const val SEGMENT_HTTP = ":segment-http"
        const val REST = ":rest"
        const val REST_HTTPS = ":rest-https"
        const val IGNORE_CASE = Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
        val HOST: Pattern = Pattern.compile("^[a-z0-9-]+(\\.[a-z0-9-]+)+(:\\d+)?([/?#]|$)", IGNORE_CASE)
        val LINK: Pattern = Pattern.compile("""https?://[^\s<>"]+""", IGNORE_CASE)
        val TRAILING = charArrayOf('.', ',', ';', ':', '!', '?', ')', ']', '}', '\'')
    }
}
