from django.conf import settings
from django.http import JsonResponse
from google import genai
import json
from django.views.decorators.csrf import csrf_exempt

from .models import InterviewSession


# --------------------------------------------------
# Health Check
# --------------------------------------------------

def health_check(request):
    return JsonResponse({
        "status": "ok",
        "message": "AI Mock Interview backend is running"
    })


# --------------------------------------------------
# Test Gemini
# --------------------------------------------------

def test_gemini(request):
    try:
        client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

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


# --------------------------------------------------
# Generate Interview Questions
# --------------------------------------------------

@csrf_exempt
def generate_questions(request):

    print("GENERATE QUESTIONS CALLED")

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

        raw_text = response.text.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.replace("```json", "")
            raw_text = raw_text.replace("```", "")
            raw_text = raw_text.strip()

        result = json.loads(raw_text)

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




@csrf_exempt
def sessions(request):

    # ----------------------------------------------
    # GET SESSIONS
    # ----------------------------------------------

    if request.method == "GET":

        try:
            interview_sessions = InterviewSession.objects.all().order_by(
                "-completed_at"
            )

            session_data = []

            for session in interview_sessions:

                session_data.append({
                    "id": session.id,
                    "techStack": session.tech_stack,
                    "experience": session.experience,
                    "totalQuestions": session.total_questions,
                    "answeredQuestions": session.answered_questions,
                    "overallScore": session.overall_score,
                    "evaluation": session.evaluation,
                    "completedAt": session.completed_at.isoformat(),
                })

            return JsonResponse({
                "status": "success",
                "sessions": session_data
            })

        except Exception as e:

            print("SESSION FETCH ERROR:", repr(e))

            return JsonResponse({
                "status": "error",
                "message": str(e)
            }, status=500)

    # ----------------------------------------------
    # CREATE SESSION
    # ----------------------------------------------

    if request.method == "POST":

        try:
            data = json.loads(request.body)

            tech_stack = data.get("techStack")
            experience = data.get("experience")
            answers = data.get("answers", [])

            evaluation = data.get("evaluation", {})
            overall_score = data.get("overallScore", 0)

            if not tech_stack or not experience:
                return JsonResponse({
                    "status": "error",
                    "message": "Tech stack and experience are required"
                }, status=400)

            answered_questions = sum(
                1
                for item in answers
                if item.get("answer", "").strip()
            )

            session = InterviewSession.objects.create(
                tech_stack=tech_stack,
                experience=experience,
                total_questions=len(answers),
                answered_questions=answered_questions,
                answers=answers,
                overall_score=overall_score,
                evaluation=evaluation,
            )

            return JsonResponse({
                "status": "success",
                "session": {
                    "id": session.id,
                    "techStack": session.tech_stack,
                    "experience": session.experience,
                    "totalQuestions": session.total_questions,
                    "answeredQuestions": session.answered_questions,
                    "overallScore": session.overall_score,
                    "evaluation": session.evaluation,
                    "completedAt": session.completed_at.isoformat(),
                }
            }, status=201)

        except Exception as e:

            print("SESSION CREATE ERROR:", repr(e))

            return JsonResponse({
                "status": "error",
                "message": str(e)
            }, status=500)

    return JsonResponse({
        "status": "error",
        "message": "Method not allowed"
    }, status=405)


# --------------------------------------------------
# AI Interview Evaluation
# --------------------------------------------------

@csrf_exempt
def evaluate_interview(request):

    if request.method != "POST":
        return JsonResponse({
            "status": "error",
            "message": "POST request required"
        }, status=405)

    try:

        data = json.loads(request.body)

        tech_stack = data.get(
            "techStack",
            "Python"
        )

        experience = data.get(
            "experience",
            "Fresher"
        )

        answers = data.get(
            "answers",
            []
        )

        if not answers:
            return JsonResponse({
                "status": "error",
                "message": "No answers provided"
            }, status=400)

        # ------------------------------------------
        # Format candidate answers
        # ------------------------------------------

        formatted_answers = ""

        for index, item in enumerate(
            answers,
            start=1
        ):

            question = item.get(
                "question",
                ""
            )

            answer = item.get(
                "answer",
                ""
            )

            formatted_answers += f"""
Question {index}: {question}

Candidate Answer:
{answer if answer else "No answer provided"}

--------------------------------
"""

        # ------------------------------------------
        # Evaluation Prompt
        # ------------------------------------------

        prompt = f"""
You are an experienced technical interviewer.

Evaluate a candidate's mock technical interview.

Candidate experience level:
{experience}

Technical stack:
{tech_stack}

Interview questions and candidate answers:

{formatted_answers}

Evaluate the candidate based on:

1. Technical correctness
2. Understanding of concepts
3. Relevance
4. Clarity
5. Completeness
6. Practical understanding

Return ONLY valid JSON.

Use exactly this structure:

{{
    "overallScore": 0,
    "strengths": [],
    "weaknesses": [],
    "improvements": [],
    "questionFeedback": [
        {{
            "questionNumber": 1,
            "score": 0,
            "feedback": ""
        }}
    ]
}}

Rules:

- overallScore must be between 0 and 100.
- Each question score must be between 0 and 100.
- Missing answers must receive a score of 0.
- Be honest and realistic.
- Do not give unnecessarily high scores.
- Feedback should be concise and useful.
- Return valid JSON only.
"""

        # ------------------------------------------
        # Gemini Client
        # ------------------------------------------

        client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt
        )

        # ------------------------------------------
        # Clean AI Response
        # ------------------------------------------

        raw_text = response.text.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.replace(
                "```json",
                ""
            )

            raw_text = raw_text.replace(
                "```",
                ""
            )

            raw_text = raw_text.strip()

        evaluation = json.loads(
            raw_text
        )

        overall_score = float(
            evaluation.get(
                "overallScore",
                0
            )
        )

        # ------------------------------------------
        # Return Evaluation
        # ------------------------------------------

        return JsonResponse({
            "status": "success",
            "evaluation": evaluation,
            "overallScore": overall_score
        })

    except json.JSONDecodeError:

        print(
            "AI returned invalid JSON"
        )

        return JsonResponse({
            "status": "error",
            "message": "AI returned invalid JSON"
        }, status=500)

    except Exception as e:

        print("================================")
        print(
            "EVALUATION ERROR:",
            repr(e)
        )
        print("================================")

        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)