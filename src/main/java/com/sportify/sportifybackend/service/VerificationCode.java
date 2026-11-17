package com.sportify.sportifybackend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

@Component
public class VerificationCode {

    private final SecureRandom random = new SecureRandom();
    private final SecretKeySpec key;

    public VerificationCode(
            @Value("${sportify.email-verification.secret}") String secret
    ) {
        byte[] bytes = Base64.getDecoder().decode(secret);
        if (bytes.length < 32) {
            throw new IllegalArgumentException(
                    "La clé de vérification doit contenir au moins 32 octets."
            );
        }
        this.key = new SecretKeySpec(bytes, "HmacSHA256");
    }

    public String generate() {
        return String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
    }

    public String digest(Long userId, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            byte[] input = (userId + ":" + code).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(mac.doFinal(input));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException(
                    "Impossible de calculer l’empreinte du code.", exception
            );
        }
    }
}