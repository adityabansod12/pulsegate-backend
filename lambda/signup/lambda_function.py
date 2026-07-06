import json
import os
import base64
import uuid
import boto3
from botocore.exceptions import ClientError

# AWS Clients
s3 = boto3.client("s3")
rekognition = boto3.client("rekognition")
dynamodb = boto3.resource("dynamodb")

BUCKET_NAME = os.environ["BUCKET_NAME"]
COLLECTION_ID = os.environ["COLLECTION_ID"]
TABLE_NAME = os.environ["TABLE_NAME"]

table = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST"
}


def lambda_handler(event, context):

    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": ""
        }

    try:

        body = json.loads(event["body"])

        member_id = str(uuid.uuid4())

        name = body["name"]
        expiry = body["expiry"]
        image_base64 = body["image"]

        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]

        image_bytes = base64.b64decode(image_base64)

        image_key = f"{uuid.uuid4()}.jpg"

        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=image_key,
            Body=image_bytes,
            ContentType="image/jpeg"
        )

        response = rekognition.index_faces(
            CollectionId=COLLECTION_ID,
            Image={
                "S3Object": {
                    "Bucket": BUCKET_NAME,
                    "Name": image_key
                }
            },
            DetectionAttributes=[]
        )

        face_records = response.get("FaceRecords", [])

        if not face_records:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "message": "No face detected."
                })
            }

        face_id = face_records[0]["Face"]["FaceId"]

        table.put_item(
            Item={
                "faceId": face_id,
                "memberId": member_id,
                "name": name,
                "expiry": expiry,
                "imageKey": image_key
            }
        )

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "message": "Member registered successfully",
                "memberId": member_id,
                "faceId": face_id
            })
        }

    except ClientError as e:

        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "error": e.response["Error"]["Message"]
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