package com.sportify.sportifybackend.dto.response;

import com.sportify.sportifybackend.entity.User;

public record ProfileResponse(
        Long id,
        String firstName,
        String lastName,
        String email,
        String role
) {
    public static ProfileResponse from(User user) {
        return new ProfileResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole().name()
        );
    }
}