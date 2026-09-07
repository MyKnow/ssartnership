FROM node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7
ARG RESPONSE_STATUS=200
ENV RESPONSE_STATUS=${RESPONSE_STATUS}
USER node
CMD ["node", "-e", "require('http').createServer((_,res)=>{res.statusCode=Number(process.env.RESPONSE_STATUS);res.end('synthetic deploy fixture');}).listen(3000,'0.0.0.0')"]
