pipeline {
    agent any

    environment {
        ANSIBLE_DIR = "/opt/ansible-project"
        INVENTORY = "${ANSIBLE_DIR}/inventories/hosts"
        DEPLOY_PLAYBOOK = "${ANSIBLE_DIR}/deploy-node-nginx.yml"
        UPDATE_PLAYBOOK = "${ANSISBLE_DIR}/update-node.yml"
        SSH_KEY_ID = "ansible_ssh_key"
    }

    stages {

        stage('Checkout Code') {
            steps {
                checkout scm
                echo "Deploying branch: ${env.BRANCH_NAME}"
            }
        }

        stage('Determine Target Host') {
            steps {
                script {

                    // Define target Ansible group AND SSH host
                    if (env.BRANCH_NAME == 'main') { 
                        GROUP = "production"
                        SSH_HOST = "server2"        // from inventory
                    } 
                    else if (env.BRANCH_NAME == 'staging') { 
                        GROUP = "staging"
                        SSH_HOST = "server1"
                    } 
                    else if (env.BRANCH_NAME == 'dev') { 
                        GROUP = "testing"
                        SSH_HOST = "server3"
                    } 
                    else { 
                        error("❌ Branch ${env.BRANCH_NAME} not allowed!")
                    }

                    echo "Using Ansible group: ${GROUP}"
                    echo "Using SSH host: ${SSH_HOST}"
                }
            }
        }

        stage('Deploy/Update via Ansible') {
            steps {
                script {
                    sshagent(credentials: [SSH_KEY_ID]) {

                        sh """
                        # Check if app exists on remote host
                        if ssh ${SSH_HOST} 'test -d /var/www/crud-app'; then
                          echo 'App exists — running update playbook'
                          ansible-playbook ${UPDATE_PLAYBOOK} -i ${INVENTORY} --limit ${GROUP}
                        else
                          echo 'First deploy — running full deploy playbook'
                          ansible-playbook ${DEPLOY_PLAYBOOK} -i ${INVENTORY} --limit ${GROUP}
                        fi
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo "🎉 Deployment completed on host group: ${GROUP}"
        }
        failure {
            echo "❌ Deployment failed — check logs"
        }
    }
}
