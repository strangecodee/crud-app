pipeline {
    agent any

    environment {
        ANSIBLE_DIR = "/opt/ansible-project"
        INVENTORY = "${ANSIBLE_DIR}/inventories/hosts"
        PLAYBOOK = "${ANSIBLE_DIR}/deploy-node-nginx.yml"
        SSH_KEY_ID = "ansible_ssh_key"      // Stored in Jenkins Credentials
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
                echo "🔄 Deploying from branch: ${env.BRANCH_NAME}"
            }
        }

        stage('Install Ansible if missing') {
            steps {
                sh '''
                if ! command -v ansible >/dev/null; then
                  echo "⚙️ Installing Ansible..."
                  sudo apt update
                  sudo apt install -y ansible
                else
                  echo "✔️ Ansible already installed"
                fi
                '''
            }
        }

        stage('Determine Target Host') {
            steps {
                script {
                    if (env.BRANCH_NAME == 'main') {
                        TARGET_HOST = "production"
                    } else if (env.BRANCH_NAME == 'staging') {
                        TARGET_HOST = "staging"
                    } else if (env.BRANCH_NAME == 'dev') {
                        TARGET_HOST = "testing"
                    } else {
                        error("❌ Branch ${env.BRANCH_NAME} is not allowed for deployment.")
                    }
                    echo "🚀 Deploying to environment: ${TARGET_HOST}"
                }
            }
        }

        stage('Deploy using Ansible') {
            steps {
                script {
                    sshagent(credentials: [SSH_KEY_ID]) {
                        sh """
                        cd ${ANSIBLE_DIR}
                        export ANSIBLE_HOST_KEY_CHECKING=False
                        echo "🚀 Running Ansible Playbook for ${TARGET_HOST}"
                        ansible-playbook ${PLAYBOOK} -i ${INVENTORY} --limit ${TARGET_HOST} -vvv
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo "🎉 Deployment Successful on ${TARGET_HOST}!"
        }
        failure {
            echo "❌ Deployment Failed on ${TARGET_HOST}. Check logs and fix issues."
        }
    }
}
