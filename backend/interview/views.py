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
            model="gemini-3.5-flash-lite",
            contents="Say hello in one short sentence."
        )

        return JsonResponse({
            "status": "success",
            "message": response.text
        })

    except Exception as e:
        print("================================")
        print("GEMINI ERROR:", repr(e))
        print("================================")

        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)

@csrf_exempt
def generate_questions(request):
    print("GENERATE QUESTIONS CALLED")

    if request.method != "POST":
        return JsonResponse({
            "status": "error",
            "message": "Only POST requests are allowed"
        }, status=405)

    try:
        print("STEP 1: Reading request")

        data = json.loads(request.body)

        experience = data.get("experience")
        tech_stack = data.get("techStack")

        

        if not experience or not tech_stack:
            return JsonResponse({
                "status": "error",
                "message": "Experience and tech stack are required"
            }, status=400)

        

        client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

       

        prompt = f"""
You are a technical interviewer.

Create exactly 10 technical interview questions for a candidate with:

Experience: {experience}
Technology: {tech_stack}

Requirements:
- Match the candidate's experience level.
- Focus primarily on {tech_stack}.
- Include both conceptual and practical questions.
- Gradually increase the difficulty.
- Do not provide answers.
- Return ONLY valid JSON.

Use exactly this format:

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
            model="gemini-3.5-flash-lite",
            contents=prompt
        )

       

        result = json.loads(response.text)

        
        return JsonResponse({
            "status": "success",
            "questions": result["questions"]
        })

    except Exception as e:
        print("================================")
        print("GEMINI ERROR:", repr(e))
        print("================================")

        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)