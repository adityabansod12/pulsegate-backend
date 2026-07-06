import json
import os
import base64
import boto3
from datetime import datetime

rekognition = boto3.client("rekognition")
dynamodb = boto3.resource("dynamodb")

COLLECTION_ID = os.environ["COLLECTION_ID"]
TABLE_NAME = os.environ["TABLE_NAME"]

table = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST"
}


def lambda_handler(event, context):

    # Handle CORS preflight request
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": ""
        }

    try:

        body = json.loads(event["body"])

        image_base64 = body["image"]

        # Remove Data URL prefix if present
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]

        image_bytes = base64.b64decode(image_base64)

        # Search face in Rekognition collection
        response = rekognition.search_faces_by_image(
            CollectionId=COLLECTION_ID,
            Image={
                "Bytes": image_bytes
            },
            FaceMatchThreshold=90,
            MaxFaces=1
        )

        matches = response.get("FaceMatches", [])

        if not matches:
            return {
                "statusCode": 404,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "message": "Face not recognized"
                })
            }

        face_id = matches[0]["Face"]["FaceId"]

        # Get member from DynamoDB
        result = table.get_item(
            Key={
                "faceId": face_id
            }
        )

        if "Item" not in result:
            return {
                "statusCode": 404,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "message": "Member not found"
                })
            }

        member = result["Item"]

        expiry = datetime.strptime(
            member["expiry"],
            "%Y-%m-%d"
        ).date()

        if expiry < datetime.utcnow().date():
            return {
                "statusCode": 403,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "message": "Membership Expired",
                    "name": member["name"]
                })
            }

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "message": "Access Granted",
                "name": member["name"],
                "memberId": member["memberId"]
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "error": str(e)
            })
        }