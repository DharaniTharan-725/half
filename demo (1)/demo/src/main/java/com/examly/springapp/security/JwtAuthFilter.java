package com.examly.springapp.security;

import com.examly.springapp.repository.AdminRepository;
import com.examly.springapp.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.List;
import org.springframework.util.AntPathMatcher;

@Slf4j
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

	@Autowired
	private JwtUtil jwtUtil;

	@Autowired
	private AdminRepository adminRepository;

	@Autowired
	private UserRepository userRepository;

	private static final List<String> PUBLIC_ENDPOINTS = List.of(
		"/api/auth/admin/register",
		"/api/auth/user/register",
		"/api/auth/login",
		"/api/auth/init",
		"/api/feedback",
		"/api/feedback/user/**",
		"/v3/api-docs/**",
		"/swagger-ui/**",
		"/swagger-ui.html"
	);
	private final AntPathMatcher pathMatcher = new AntPathMatcher();

	@Override
	protected void doFilterInternal(
			@NonNull HttpServletRequest request,
			@NonNull HttpServletResponse response,
			@NonNull FilterChain filterChain
	) throws ServletException, IOException {
		String path = request.getServletPath();

		// Skip JWT filter if path matches public endpoints
		for (String pattern : PUBLIC_ENDPOINTS) {
			if (pathMatcher.match(pattern, path)) {
				filterChain.doFilter(request, response);
				return;
			}
		}

		String authHeader = request.getHeader("Authorization");
		if (authHeader != null && authHeader.startsWith("Bearer ")) {
			try {
				String token = authHeader.substring(7);
				String email = jwtUtil.extractUsername(token);

				if (email != null && jwtUtil.validateToken(token)) {
					// Check if user exists and determine role
					String role = "USER"; // Default role
					
					// Check admin first
					if (adminRepository.findByEmail(email).isPresent()) {
						role = "ADMIN";
					} else if (userRepository.findByEmail(email).isPresent()) {
						role = "USER";
					} else {
						// User not found in either table
						log.warn("User not found for email: {}", email);
						filterChain.doFilter(request, response);
						return;
					}

					// Create authentication with appropriate role
					UsernamePasswordAuthenticationToken authentication =
							new UsernamePasswordAuthenticationToken(
								email, 
								null, 
								List.of(new SimpleGrantedAuthority("ROLE_" + role))
							);
					authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
					SecurityContextHolder.getContext().setAuthentication(authentication);
					log.debug("Authenticated user {} with role {}", email, role);
				}
			} catch (Exception e) {
				// Log the exception but don't throw it to avoid breaking the filter chain
				log.error("JWT token validation failed", e);
			}
		} else {
			log.debug("No Authorization header found for path: {}", path);
		}

		filterChain.doFilter(request, response);
	}
}
