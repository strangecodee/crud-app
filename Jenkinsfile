pipeline {
    agent any

    environment {
    ANSIBLE_DIR = "/opt/ansible-project"
    INVENTORY = "/opt/ansible-project/inventories/hosts"
    PLAYBOOK = "/opt/ansible-project/deploy-node-nginx.yml"
    SSH_KEY_ID = "ansible_ssh_key"
}

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
                echo "Deploying branch: ${env.BRANCH_NAME}"
            }
        }

        stage('Install Ansible if missing') {
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
                    def target_host
                    if (env.BRANCH_NAME == 'main') {
                        target_host = "production"
                    } else if (env.BRANCH_NAME == 'staging') {
                        target_host = "staging"
                    } else if (env.BRANCH_NAME == 'dev') {
                        target_host = "testing"
                    } else {
                        error("This branch is not meant for deployment: ${env.BRANCH_NAME}")
                    }

                    withCredentials([sshUserPrivateKey(credentialsId: SSH_KEY_ID, keyFileVariable: 'SSH_KEY')]) {
                        sh """
                        cd ${ANSIBLE_DIR}
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
        failure { echo "Deployment Failed — Check Console Logs" }
    }
}
