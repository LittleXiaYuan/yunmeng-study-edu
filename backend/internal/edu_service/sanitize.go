package edu_service

func sanitizeUser(user User) User {
	user.PasswordHash = ""
	return user
}

func sanitizeUsers(users []User) []User {
	out := make([]User, 0, len(users))
	for _, user := range users {
		out = append(out, sanitizeUser(user))
	}
	return out
}

func sanitizeDashboard(d Dashboard) Dashboard {
	d.Users = sanitizeUsers(d.Users)
	return d
}

func sanitizeLLMConfig(config LLMConfig) LLMConfig {
	if config.APIKey != "" {
		config.APIKey = "********"
	}
	return config
}
