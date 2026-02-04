"""
Google Cloud Storage Utilities
handles file uploads and signed URL generation for digital product delivery
"""

import os
import logging
from typing import Optional
from google.cloud import storage
from datetime import timedelta

logger = logging.getLogger(__name__)


class StorageAdapter:
    """
    Google Cloud Storage adapter for file operations
    """

    def __init__(self):
        """
        initialize Cloud Storage client
        """
        self.bucket_name = os.getenv('STORAGE_BUCKET', f"{os.getenv('GOOGLE_CLOUD_PROJECT')}.appspot.com")

        try:
            self.client = storage.Client()
            self.bucket = self.client.bucket(self.bucket_name)
            logger.info(f"✅ Storage initialized: bucket={self.bucket_name}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Storage: {e}")
            raise

    def upload_file(self, local_path: str, destination_path: str) -> bool:
        """
        upload a file to Cloud Storage
        args:
            local_path: Local file path
            destination_path: Destination path in bucket (e.g., "products/file.pdf")
        returns:
            bool: True if successful
        """
        try:
            blob = self.bucket.blob(destination_path)
            blob.upload_from_filename(local_path)
            logger.info(f"✅ Uploaded: {destination_path}")
            return True
        except Exception as e:
            logger.error(f"Error uploading file: {e}")
            return False

    def get_signed_url(self, blob_path: str, expiration_hours: int = 24) -> Optional[str]:
        """
        generate a signed URL for accessing a file
        args:
            blob_path: path to the blob in the bucket
            expiration_hours: how many hours the URL should be valid
        returns:
            Signed URL string or None if failed
        """
        try:
            blob = self.bucket.blob(blob_path)

            if not blob.exists():
                logger.warning(f"Blob does not exist: {blob_path}")
                return None

            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(hours=expiration_hours),
                method="GET"
            )

            logger.info(f"✅ Generated signed URL for: {blob_path}")
            return url

        except Exception as e:
            logger.error(f"Error generating signed URL: {e}")
            return None

    def delete_file(self, blob_path: str) -> bool:
        """
        delete a file from Cloud Storage
        """
        try:
            blob = self.bucket.blob(blob_path)
            blob.delete()
            logger.info(f"✅ Deleted: {blob_path}")
            return True
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return False

    def file_exists(self, blob_path: str) -> bool:
        """
        check if a file exists in Cloud Storage
        """
        try:
            blob = self.bucket.blob(blob_path)
            return blob.exists()
        except Exception as e:
            logger.error(f"Error checking file existence: {e}")
            return False
