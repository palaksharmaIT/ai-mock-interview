from django.conf import settings
from django.http import JsonResponse
from google import genai
import json
from django.views.decorators.csrf import csrf_exempt


def health_check(request):
    return JsonResponse({
        "status": "ok",
        "message": "AI Mock Interview backend is running"
    })


def test_gemini(request):
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents="Say hello in one short sentence."
        )

        return JsonResponse({
            "status": "success",
            "message": response.text
        })

    except Exception as e:
        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)

def generate_questions(request):
    return JsonResponse({
        "status": "success",
        "message": "Question generation endpoint is ready"
    }) 


@csrf_exempt
def generate_questions(request):
    if request.method != "POST":
        return JsonResponse({
            "status": "error",
            "message": "Only POST requests are allowed"
        }, status=405)

    try:
        data = json.loads(request.body)

        experience = data.get("experience")
        tech_stack = data.get("techStack")

        if not experience or not tech_stack:
            return JsonResponse({
                "status": "error",
                "message": "Experience and tech stack are required"
            }, status=400)

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        prompt = f"""
You are a technical interviewer.

Create exactly 10 technical interview questions for a candidate with:
- Experience: {experience}
- Tech stack: {tech_stack}

Requirements:
- Questions should match the candidate's experience level.
- Focus mainly on {tech_stack}.
- Include a mix of conceptual and practical questions.
- Gradually increase the difficulty.
- Do not provide answers.
- Return ONLY valid JSON in this exact format:

{{
    "questions": [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5",
        "Question 6",
        "Question 7",
        "Question 8",
        "Question 9",
        "Question 10"
    ]
}}
"""

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt
        )

        result = json.loads(response.text)

        return JsonResponse({
            "status": "success",
            "questions": result["questions"]
        })

    except Exception as e:
        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)