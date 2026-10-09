from django.db import models


class InterviewSession(models.Model):
    tech_stack = models.CharField(max_length=100)
    experience = models.CharField(max_length=100)

    total_questions = models.PositiveIntegerField(default=0)
    answered_questions = models.PositiveIntegerField(default=0)

    answers = models.JSONField(default=list)

   
    overall_score = models.FloatField(default=0)
    evaluation = models.JSONField(default=dict)

    completed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tech_stack} - {self.experience}"