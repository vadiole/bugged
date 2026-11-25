package vadiole.bugged

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Test

class CleanerTest {
    private val cleaner = Cleaner(
        rules = File("src/main/assets/rules.txt").readText(),
        redirects = File("src/main/assets/redirects.txt").readText(),
    )

    @Test
    fun cases() {
        val failures = File("src/test/resources/cases.txt").readLines()
            .filter { it.isNotBlank() }
            .mapNotNull { line ->
                val (dirty, expected) = line.split(' ')
                val actual = cleaner.clean(dirty)
                if (actual == expected) null else "$dirty\n  expected $expected\n  actual   $actual"
            }
        assertEquals("", failures.joinToString("\n"))
    }

    @Test
    fun linksInsideText() {
        assertEquals(
            "Look (https://example.com/a?id=1), then https://example.com/b.",
            cleaner.cleanText(
                "Look (https://example.com/a?id=1&utm_source=x), then https://example.com/b?fbclid=abc.",
            ),
        )
    }

    @Test
    fun textWithoutLinks() {
        assertEquals("utm_source=x is not a link", cleaner.cleanText("utm_source=x is not a link"))
    }
}
