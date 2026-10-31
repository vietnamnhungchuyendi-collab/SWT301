package vn.edu.fpt;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.io.IOException;
class ProductTest {
    @BeforeAll static void startEvidence() { TestEvidence.start(); }
    @AfterAll static void saveEvidence() throws IOException { TestEvidence.save("product-results.csv"); }
    @Test void constructor_retainsAllValidFields() {
        Product p = new Product("P01", "Pen", 0.01, 1);
        TestEvidence.value("P01", "Product", "P01; Pen; 0.01; 1", "P01; Pen; 0.01; 1",
            p.getProductId() + "; " + p.getProductName() + "; " + p.getPrice() + "; " + p.getQuantity());
    }
    @ParameterizedTest(name = "{0} invalid Product")
    @CsvSource(value = {
        "P02, NULL, Pen, 10, 1, Product ID is required",
        "P03, '', Pen, 10, 1, Product ID is required",
        "P04, P01, NULL, 10, 1, Product name is required",
        "P05, P01, '', 10, 1, Product name is required",
        "P06, P01, Pen, 0, 1, Price must be greater than 0",
        "P07, P01, Pen, -1, 1, Price must be greater than 0",
        "P08, P01, Pen, 10, 0, Quantity must be greater than 0",
        "P09, P01, Pen, 10, -1, Quantity must be greater than 0"
    }, nullValues = "NULL")
    void constructor_rejectsInvalidFields(String id, String code, String name, double price, int quantity, String message) {
        TestEvidence.exception(id, "Product", "id=" + code + "; name=" + name + "; price=" + price + "; quantity=" + quantity,
            message, () -> new Product(code, name, price, quantity));
    }
}
