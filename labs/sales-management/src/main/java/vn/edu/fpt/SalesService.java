package vn.edu.fpt;
public class SalesService {
    public double calculateSubtotal(Product product) {
        if (product == null) throw new IllegalArgumentException("Product cannot be null");
        return product.getPrice() * product.getQuantity();
    }
    public double calculateDiscount(double subtotal) {
        if (subtotal < 0) throw new IllegalArgumentException("Subtotal cannot be negative");
        if (subtotal < 1000) return 0;
        else if (subtotal < 5000) return subtotal * 0.05;
        else if (subtotal < 10000) return subtotal * 0.10;
        else return subtotal * 0.15;
    }
    public double calculateShippingFee(double subtotal) {
        if (subtotal < 0) throw new IllegalArgumentException("Subtotal cannot be negative");
        if (subtotal < 2000) return 50;
        return 0;
    }
    public double calculateTotal(Product product) {
        double subtotal = calculateSubtotal(product);
        double discount = calculateDiscount(subtotal);
        double shipping = calculateShippingFee(subtotal);
        return subtotal - discount + shipping;
    }
    public String classifyCustomer(double total) {
        // Additional assumption: negative monetary totals are invalid.
        if (total < 0) throw new IllegalArgumentException("Total cannot be negative");
        if (total < 1000) return "REGULAR";
        else if (total < 5000) return "SILVER";
        else if (total < 10000) return "GOLD";
        else return "VIP";
    }
}
