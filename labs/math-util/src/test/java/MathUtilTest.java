import com.mytam.mathutil.core.MathUtil;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
class MathUtilTest {
 @ParameterizedTest(name="factorial({0}) = {1}")
 @CsvSource({"0,1","1,1","2,2","3,6","4,24","5,120","10,3628800","19,121645100408832000","20,2432902008176640000"})
 void factorialValid(int n,long expected) {assertEquals(expected,MathUtil.getFactorial(n));}
 @ParameterizedTest(name="reject factorial({0})")
 @ValueSource(ints={-2147483648,-1,21,2147483647})
 void factorialInvalid(int n) {var ex=assertThrows(IllegalArgumentException.class,()->MathUtil.getFactorial(n));assertEquals("n must be between 0 .. 20",ex.getMessage());}
}
