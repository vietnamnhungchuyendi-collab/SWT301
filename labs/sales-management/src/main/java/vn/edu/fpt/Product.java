package vn.edu.fpt;
public class Product {
    private final String productId;
    private final String productName;
    private final double price;
    private final int quantity;
    public Product(String productId, String productName, double price, int quantity) {
        if (productId == null || productId.isEmpty()) throw new IllegalArgumentException("Product ID is required");
        if (productName == null || productName.isEmpty()) throw new IllegalArgumentException("Product name is required");
        if (price <= 0) throw new IllegalArgumentException("Price must be greater than 0");
        if (quantity <= 0) throw new IllegalArgumentException("Quantity must be greater than 0");
        this.productId = productId; this.productName = productName; this.price = price; this.quantity = quantity;
    }
    public String getProductId() { return productId; }
    public String getProductName() { return productName; }
    public double getPrice() { return price; }
    public int getQuantity() { return quantity; }
}
