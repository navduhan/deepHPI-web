#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
job_root="${script_dir}/data/jobs"
retention_minutes=43200

[[ "${job_root}" == */deploy/data/jobs ]] || { echo "Refusing unexpected job directory: ${job_root}" >&2; exit 1; }
[[ -d "${job_root}" ]] || exit 0

find "${job_root}" -mindepth 1 -maxdepth 1 -type d -mmin "+${retention_minutes}" -print -exec rm -rf -- {} +
