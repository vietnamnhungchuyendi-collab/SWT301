package vn.edu.fpt;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.io.IOException;
class SalesServiceTest {
    private SalesService service;
    @BeforeAll static void startEvidence() { TestEvidence.start(); }
    @BeforeEach void setup() { service = new SalesService(); }
    @AfterAll static void saveEvidence() throws IOException { TestEvidence.save("sales-results.csv"); }
    @ParameterizedTest(name = "{0} calculateSubtotal")
    @CsvSource({
        "S01, 500, 3, 1500",
        "S02, 1000, 2, 2000",
        "S03, 0.01, 1, 0.01"
    })
    void calculateSubtotal_returnsExpected(String id, double price, int quantity, double expected) {
        TestEvidence.number(id, "calculateSubtotal", "price=" + price + "; quantity=" + quantity,
            expected, service.calculateSubtotal(new Product("P01", "Sample", price, quantity)));
    }
    @ParameterizedTest(name = "{0} calculateDiscount")
    @CsvSource({
        "D01, 0, 0",
        "D02, 999.99, 0",
        "D03, 1000, 50",
        "D04, 4999.99, 249.9995",
        "D05, 5000, 500",
        "D06, 9999.99, 999.999",
        "D07, 10000, 1500",
        "D08, 20000, 3000"
    })
    void calculateDiscount_returnsExpected(String id, double subtotal, double expected) {
        TestEvidence.number(id, "calculateDiscount", "subtotal=" + subtotal, expected, service.calculateDiscount(subtotal));
    }
    @ParameterizedTest(name = "{0} calculateShippingFee")
    @CsvSource({
        "H01, 0, 50",
        "H02, 1999.99, 50",
        "H03, 2000, 0",
        "H04, 2000.01, 0"
    })
    void calculateShippingFee_returnsExpected(String id, double subtotal, double expected) {
        TestEvidence.number(id, "calculateShippingFee", "subtotal=" + subtotal, expected, service.calculateShippingFee(subtotal));
    }
    @ParameterizedTest(name = "{0} calculateTotal")
    @CsvSource({
        "T01, 500, 3, 1475",
        "T02, 1000, 2, 1900",
        "T03, 2500, 2, 4500",
        "T04, 5000, 2, 8500",
        "T05, 100, 1, 150"
    })
    void calculateTotal_returnsExpected(String id, double price, int quantity, double expected) {
        TestEvidence.number(id, "calculateTotal", "price=" + price + "; quantity=" + quantity,
            expected, service.calculateTotal(new Product("P01", "Sample", price, quantity)));
    }
    @ParameterizedTest(name = "{0} classifyCustomer")
    @CsvSource({
        "C01, 0, REGULAR",
        "C02, 999.99, REGULAR",
        "C03, 1000, SILVER",
        "C04, 4999.99, SILVER",
        "C05, 5000, GOLD",
        "C06, 9999.99, GOLD",
        "C07, 10000, VIP",
        "C08, 10000.01, VIP"
    })
    void classifyCustomer_returnsExpected(String id, double total, String expected) {
        TestEvidence.value(id, "classifyCustomer", "total=" + total, expected, service.classifyCustomer(total));
    }
    @Test void calculateSubtotal_rejectsInvalidInput() {
        TestEvidence.exception("S04", "calculateSubtotal", "null", "Product cannot be null", () -> service.calculateSubtotal(null));
    }
    @Test void calculateDiscount_rejectsInvalidInput() {
        TestEvidence.exception("D09", "calculateDiscount", "-1", "Subtotal cannot be negative", () -> service.calculateDiscount(-1));
    }
    @Test void calculateShippingFee_rejectsInvalidInput() {
        TestEvidence.exception("H05", "calculateShippingFee", "-1", "Subtotal cannot be negative", () -> service.calculateShippingFee(-1));
    }
    @Test void calculateTotal_rejectsInvalidInput() {
        TestEvidence.exception("T06", "calculateTotal", "null", "Product cannot be null", () -> service.calculateTotal(null));
    }
    @Test void classifyCustomer_rejectsInvalidInput() {
        TestEvidence.exception("C09", "classifyCustomer", "-1", "Total cannot be negative", () -> service.classifyCustomer(-1));
    }
}
