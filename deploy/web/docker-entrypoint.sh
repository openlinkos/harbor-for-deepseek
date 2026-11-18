#!/bin/sh
set -eu
mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp
if [ -e /dev/stdout ]; then
  ln -sfn /dev/stdout /tmp/access.log
else
  : >/tmp/access.log
fi
exec nginx -g 'daemon off;'
