import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

public class Client {

    /**
     * Message metadata:
     * 1 char result
     * 4 bytes received file size
     */
    private static final int METADATA_LENGTH = 1 + 4;
    private static int BUFFER_SIZE = 1024;

    public static void main(String[] args) throws IOException {
        byte[] bytes = Files.readAllBytes(Path.of("./image.png"));
        BUFFER_SIZE = Integer.parseInt(args[0]);
        Socket s = new Socket(Inet4Address.getByName("localhost"), 5000);

        OutputStream out = s.getOutputStream();
        InputStream in = s.getInputStream();

        String source = "png";
        String dest = "jpg";
        int size = bytes.length;
        long start = System.currentTimeMillis();

        out.write(source.getBytes());
        out.write(dest.getBytes());
        out.write(ByteBuffer.allocate(4).putInt(size).array());
        out.write(bytes);

        byte[] buffer = new byte[BUFFER_SIZE];
        int totalBytesRead = 0;
        do {
            totalBytesRead += in.read(buffer, totalBytesRead, METADATA_LENGTH);
        } while (totalBytesRead < METADATA_LENGTH);

        char result = (char) buffer[0];
        int payloadSize = ByteBuffer.wrap(Arrays.copyOfRange(buffer, 1, 5)).getInt();
        ByteArrayOutputStream baos = new ByteArrayOutputStream(payloadSize);
        totalBytesRead = totalBytesRead - METADATA_LENGTH;
        baos.write(buffer, METADATA_LENGTH, totalBytesRead);
        System.out.printf("Receiving\n\tresult = %c\n\tsize = %d\n", result, payloadSize);

        int bytesRead = 0;
        while (totalBytesRead < payloadSize && (bytesRead = in.read(buffer, 0, BUFFER_SIZE)) != -1) {
            // System.out.println("Received " + bytesRead + " bytes");
            baos.write(buffer, 0, bytesRead);
            totalBytesRead += bytesRead;
        }
        long end = System.currentTimeMillis();

        if (result == '0') {
            System.out.println("OK! Receiving " + payloadSize + " bytes");
        } else if (result == '1') {
            System.out.println("Wrong request: error message long " + payloadSize + " bytes");
            System.err.println(new String(baos.toByteArray()));
        } else if (result == '2') {
            System.out.println("Internal server error: error long " + payloadSize + " bytes");
            System.err.println(new String(baos.toByteArray()));
        }

        System.out.println("Client took " + (end - start) + "ms");
    }
}
