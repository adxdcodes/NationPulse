"""Storage backend abstraction + the file naming convention.

Naming convention (applies to both raw PDFs and extracted text so the two
are trivially pairable by eye):

    {kind}/{bill_year}/{house_slug}/{bill_number_slug}_{doc_type}_{hash8}.{ext}

Example:
    raw/2023/rajya_sabha/lvii_introduced_9f3a1c2d.pdf
    text/2023/rajya_sabha/lvii_introduced_9f3a1c2d.txt

The hash suffix comes from the downloaded file's content hash, so a
re-download of unchanged content reuses the same key (idempotent), while
a genuinely revised PDF (e.g. an errata-corrected reupload) gets a new key
without clobbering the old one.
"""
import os
import re
import hashlib
from abc import ABC, abstractmethod

import config


def slugify(value: str) -> str:
    value = (value or "unknown").strip().lower()
    value = re.sub(r"[^\w]+", "_", value)
    return re.sub(r"_+", "_", value).strip("_") or "unknown"


def build_key(*, bill_year, introduced_house, bill_number, doc_type, file_hash, ext) -> str:
    year = str(bill_year or "unknown_year")
    house = slugify(introduced_house)
    number = slugify(bill_number)
    return f"{year}/{house}/{number}_{doc_type}_{file_hash[:8]}.{ext}"


class StorageBackend(ABC):
    @abstractmethod
    def save(self, kind: str, key: str, data: bytes) -> str:
        """Persists `data` under `{kind}/{key}` and returns a storage_path
        (or URI) suitable for saving in the DB."""

    @abstractmethod
    def exists(self, kind: str, key: str) -> bool: ...


class LocalStorage(StorageBackend):
    def __init__(self, root: str = None):
        self.root = root or config.LOCAL_STORAGE_ROOT

    def _path(self, kind: str, key: str) -> str:
        return os.path.join(self.root, kind, key)

    def save(self, kind: str, key: str, data: bytes) -> str:
        path = self._path(kind, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        mode = "w" if isinstance(data, str) else "wb"
        with open(path, mode, encoding="utf-8" if mode == "w" else None) as f:
            f.write(data)
        return path

    def exists(self, kind: str, key: str) -> bool:
        return os.path.exists(self._path(kind, key))


class S3Storage(StorageBackend):
    def __init__(self, bucket: str = None, region: str = None):
        import boto3
        self.bucket = bucket or config.S3_BUCKET
        self.client = boto3.client("s3", region_name=region or config.S3_REGION)

    def _key(self, kind: str, key: str) -> str:
        return f"{kind}/{key}"

    def save(self, kind: str, key: str, data: bytes) -> str:
        full_key = self._key(kind, key)
        body = data.encode("utf-8") if isinstance(data, str) else data
        self.client.put_object(Bucket=self.bucket, Key=full_key, Body=body)
        return f"s3://{self.bucket}/{full_key}"

    def exists(self, kind: str, key: str) -> bool:
        import botocore
        try:
            self.client.head_object(Bucket=self.bucket, Key=self._key(kind, key))
            return True
        except botocore.exceptions.ClientError:
            return False


def get_storage() -> StorageBackend:
    if config.STORAGE_BACKEND == "s3":
        return S3Storage()
    return LocalStorage()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
