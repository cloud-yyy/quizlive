#!/usr/bin/env bash
# Deploy QuizLive on the VPS. Called by GitHub Actions over SSH with a dedicated key
# that is restricted in ~/.ssh/authorized_keys to this script only:
#   command="/home/cloudy/apps/quizlive/deploy/deploy.sh",restrict ssh-ed25519 AAAA... github-actions-deploy
# The branch comes from the SSH command line ("deploy <branch>").
# The body is wrapped in a function so bash parses it fully before git updates this file.
set -euo pipefail

main() {
  local branch
  branch="$(echo "${SSH_ORIGINAL_COMMAND:-${1:-}}" | awk '{print $NF}')"
  case "$branch" in
    main|ipr22|kr22) ;;
    *) echo "refusing to deploy branch '${branch}'" >&2; exit 2 ;;
  esac

  cd "$(dirname "$(readlink -f "$0")")/.."
  echo "==> fetching ${branch}"
  git fetch --prune --quiet origin "${branch}"
  git checkout --quiet -B "${branch}" "origin/${branch}"
  export APP_VERSION
  APP_VERSION="$(git rev-parse --short HEAD)"

  echo "==> building and starting containers (${APP_VERSION})"
  docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

  echo "==> waiting for /health"
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:8110/api/health >/dev/null 2>&1; then
      curl -fsS http://127.0.0.1:8110/api/health; echo
      docker image prune -f >/dev/null
      echo "==> deployed ${branch} @ ${APP_VERSION}"
      return 0
    fi
    sleep 3
  done
  echo "health check failed" >&2
  docker compose -f docker-compose.prod.yml logs --tail 50 server >&2
  exit 1
}

main "$@"
exit
