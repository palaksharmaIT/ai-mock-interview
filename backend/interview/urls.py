from django.urls import path
from .views import (
    generate_questions,
    health_check,
    test_gemini,
    sessions,
    evaluate_interview,
)


urlpatterns = [
    path("health/", health_check),
    path("test-gemini/", test_gemini),
    path("generate-questions/", generate_questions),
    path("sessions/", sessions),
    path("evaluate-interview/", evaluate_interview),
]