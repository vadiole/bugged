package vadiole.bugged

import java.util.Collections

internal fun String.splitBy(delimiter: Char): List<String> {
    var next = indexOf(delimiter)
    if (next < 0) return Collections.singletonList(this)
    val parts = ArrayList<String>()
    var at = 0
    do {
        parts.add(substring(at, next))
        at = next + 1
        next = indexOf(delimiter, at)
    } while (next >= 0)
    parts.add(substring(at))
    return parts
}
