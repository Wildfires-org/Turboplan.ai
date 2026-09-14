#!/bin/bash
set -e

if [ -f cert.p12 ]; then
  echo "cert.p12 already exists. Delete it first to regenerate."
  exit 1
fi

read -s -p "Enter certificate password (min 4 chars): " CERT_PASS
echo

openssl genrsa -out private.key 2048
openssl req -new -x509 -key private.key -out certificate.crt -days 3650 \
  -subj "/CN=TurboPlan Document Signing"
openssl pkcs12 -export -out cert.p12 -inkey private.key -in certificate.crt \
  -password "pass:${CERT_PASS}" \
  -keypbe PBE-SHA1-3DES \
  -certpbe PBE-SHA1-3DES \
  -macalg sha1

rm private.key certificate.crt

echo ""
echo "cert.p12 generated. Set NEXT_PRIVATE_SIGNING_PASSPHRASE=${CERT_PASS} in your .env"
