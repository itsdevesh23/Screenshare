package com.company.inspection.config;

import com.company.inspection.user.AppUser;
import com.company.inspection.user.UserRepository;
import com.company.inspection.user.UserRole;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seedUsers(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            createUserIfMissing(userRepository, passwordEncoder, "sbu1", "password", UserRole.SBU);
            createUserIfMissing(userRepository, passwordEncoder, "inspector1", "password", UserRole.INSPECTOR);
        };
    }

    private void createUserIfMissing(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            String username,
            String password,
            UserRole role
    ) {
        if (!userRepository.existsByUsername(username)) {
            userRepository.save(new AppUser(username, passwordEncoder.encode(password), role));
        }
    }
}

