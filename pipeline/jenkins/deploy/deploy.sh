# docker container run
cd /var/jenkins_home/workspace/bbb-pipeline/
docker compose up -d

# delete dangling images
docker image prune