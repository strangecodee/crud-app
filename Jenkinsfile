pipeline {
    agent any

    environment {
        INVENTORY = "inventories/hosts"
        PLAYBOOK = "deploy-node-nginx.yml"
        SSH_KEY_ID = "ansible_ssh_key"
    }

    stages {
        stage('Checkout Code') {
            steps {
                git branch: "${env.BRANCH_NAME}", url: 'https://github.com/strangecodee/crud-app.git'
            }
        }

        stage('Install Ansible if not present') {
            steps {
                sh '''
                if ! command -v ansible >/dev/null; then
                  sudo apt update
                  sudo apt install -y ansible
                fi
                '''
            }
        }

        stage('Deploy using Ansible') {
            steps {
                script {
                    if (env.BRANCH_NAME == 'main') {
                        target_host = "production"
                    } else if (env.BRANCH_NAME == 'staging') {
                        target_host = "staging"
                    } else if (env.BRANCH_NAME == 'dev') {
                        target_host = "testing"
                    } else {
                        error("This branch is not meant for deployment")
                    }

                    withCredentials([sshUserPrivateKey(credentialsId: SSH_KEY_ID, keyFileVariable: 'SSH_KEY')]) {
                        sh """
                        export ANSIBLE_HOST_KEY_CHECKING=False
                        ansible-playbook ${PLAYBOOK} -i ${INVENTORY} --limit ${target_host}
                        """
                    }
                }
            }
        }
    }

    post {
        success { echo "Deployment Successful!" }
        failure { echo "Deployment Failed! Check logs." }
    }
}
