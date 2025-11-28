pipeline {
    agent any

    environment {
        ANSIBLE_DIR = "/opt/ansible-project"
        INVENTORY = "${ANSIBLE_DIR}/inventories/hosts"
        DEPLOY_PLAYBOOK = "${ANSIBLE_DIR}/deploy-node-nginx.yml"
        UPDATE_PLAYBOOK = "${ANSIBLE_DIR}/update-node.yml"
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
                    if (env.BRANCH_NAME == 'main') { TARGET_HOST = "production" }
                    else if (env.BRANCH_NAME == 'staging') { TARGET_HOST = "staging" }
                    else if (env.BRANCH_NAME == 'dev') { TARGET_HOST = "testing" }
                    else { error("❌ Branch ${env.BRANCH_NAME} not allowed!") }
                }
            }
        }

        stage('Deploy/Update via Ansible') {
            steps {
                script {
                    sshagent(credentials: [SSH_KEY_ID]) {

                        // If first deployment (no app directory), run full playbook
                        sh """
                        if ssh $TARGET_HOST 'test -d /var/www/crud-app'; then
                          ansible-playbook ${UPDATE_PLAYBOOK} -i ${INVENTORY} --limit ${TARGET_HOST}
                        else
                          ansible-playbook ${DEPLOY_PLAYBOOK} -i ${INVENTORY} --limit ${TARGET_HOST}
                        fi
                        """
                    }
                }
            }
        }
    }

    post {
        success { echo "🎉 Code Updated Successfully on ${TARGET_HOST}!" }
        failure { echo "❌ Update Failed — Check Logs" }
    }
}
