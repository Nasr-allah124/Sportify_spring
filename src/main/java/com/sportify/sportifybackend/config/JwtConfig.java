package com.sportify.sportifybackend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

@Configuration
public class JwtConfig {

    public static final String ISSUER = "sportify-api";

    @Bean
    public SecretKey jwtKey(@Value("${sportify.jwt.secret}") String secret) {
        byte[] bytes = Base64.getDecoder().decode(secret);

        if (bytes.length < 32) {
            throw new IllegalArgumentException(
                    "SPORTIFY_JWT_SECRET doit contenir au moins 32 octets."
            );
        }

        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey jwtKey) {
        return NimbusJwtEncoder.withSecretKey(jwtKey)
                .algorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    public JwtDecoder jwtDecoder(SecretKey jwtKey) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
        return decoder;
    }
}