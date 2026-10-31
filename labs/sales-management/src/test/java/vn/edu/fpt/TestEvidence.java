package vn.edu.fpt;
import java.nio.file.*;
import java.io.IOException;
import java.util.*;
import org.junit.jupiter.api.function.Executable;
import static org.junit.jupiter.api.Assertions.*;

/** Records actual execution values before assertions; contains no business rules. */
final class TestEvidence {
    private static final List<String> ROWS = new ArrayList<>();
    static synchronized void start() { ROWS.clear(); }
    static String quote(Object value) { return "\"" + String.valueOf(value).replace("\"", "\"\"") + "\""; }
    static synchronized void record(String id, String method, String input, Object expected, Object actual, boolean pass) {
        ROWS.add(String.join(",", quote(id), quote(method), quote(input), quote(expected), quote(actual), quote(pass ? "PASS" : "FAIL")));
    }
    static void number(String id, String method, String input, double expected, double actual) {
        record(id, method, input, expected, actual, Math.abs(expected - actual) <= 0.001);
        assertEquals(expected, actual, 0.001, id);
    }
    static void value(String id, String method, String input, Object expected, Object actual) {
        record(id, method, input, expected, actual, Objects.equals(expected, actual));
        assertEquals(expected, actual, id);
    }
    static void exception(String id, String method, String input, String message, Executable action) {
        try {
            IllegalArgumentException error = assertThrows(IllegalArgumentException.class, action, id);
            record(id, method, input, "IllegalArgumentException: " + message,
                "IllegalArgumentException: " + error.getMessage(), Objects.equals(message, error.getMessage()));
            assertEquals(message, error.getMessage(), id);
        } catch (AssertionError error) {
            if (ROWS.stream().noneMatch(row -> row.startsWith(quote(id) + ",")))
                record(id, method, input, "IllegalArgumentException: " + message, "No IllegalArgumentException", false);
            throw error;
        }
    }
    static synchronized void save(String filename) throws IOException {
        Path out = Path.of("target", filename);
        Files.createDirectories(out.getParent());
        List<String> lines = new ArrayList<>();
        lines.add("Test ID,Method,Input,Expected,Actual,Result");
        ROWS.stream().sorted().forEach(lines::add);
        Files.write(out, lines, java.nio.charset.StandardCharsets.UTF_8);
    }
}
