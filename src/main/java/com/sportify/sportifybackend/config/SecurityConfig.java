package com.sportify.sportifybackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                return http
                                .csrf(csrf -> csrf.ignoringRequestMatchers(
                                                "/api/v1/auth/register",
                                                "/api/v1/auth/verify-email"))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/v1/auth/register",
                                                                "/api/v1/auth/verify-email")
                                                .permitAll()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/v1/complexes",
                                                                "/api/v1/fields",
                                                                "/api/v1/fields/{id}")
                                                .permitAll()
                                                .anyRequest().authenticated())
                                .build();
        }
}