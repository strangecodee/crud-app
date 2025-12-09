```

```

# User Management CRUD Application

A comprehensive User Management system built with Node.js, Express, Sequelize, MySQL, and EJS. This application provides full CRUD operations, user authentication, bulk actions, CSV import/export, and more.

## Features

- **User Authentication**: Secure login system with session management
- **CRUD Operations**: Create, Read, Update, Delete users
- **Bulk Operations**: Bulk delete users with checkbox selection
- **Search & Filter**: Advanced search by name or email with filtering options
- **Pagination & Sorting**: Efficient data handling with customizable pagination and sorting
- **CSV Import/Export**: Import users from CSV files and export user data to CSV
- **File Upload**: Secure file upload functionality with validation
- **Dashboard**: Overview with user statistics (total users, new users in last 7/30 days)
- **Proxy Tester**: Built-in proxy testing tool for HTTP requests
- **Responsive UI**: Modern interface built with TailwindCSS and EJS templates
- **Error Handling**: Comprehensive error handling and user feedback
- **Logging**: Detailed request logging for debugging and monitoring

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL with Sequelize ORM
- **Frontend**: EJS templating engine, TailwindCSS
- **Authentication**: Express-session
- **File Handling**: Multer for file uploads
- **CSV Processing**: json2csv for data export
- **Development**: Nodemon for hot reloading
- **Build Tools**: TailwindCSS CLI

## Prerequisites

Before running this application, make sure you have the following installed:

- Node.js (v14 or higher)
- MySQL Server
- npm or yarn package manager

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd crud-app
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up the database:**

   - Create a MySQL database
   - Update the database configuration in `sequelize.js`

4. **Environment Setup:**
   Create a `.env` file in the root directory with the following variables:

   ```
   DB_HOST=localhost
   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password
   DB_NAME=your_database_name
   SESSION_SECRET=your_session_secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=password
   PORT=5000
   ```

5. **Build CSS:**

   ```bash
   npm run build:css
   ```

## Usage

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **For production:**

   ```bash
   npm start
   ```

3. **Access the application:**
   Open your browser and navigate to `http://localhost:5000`
4. **Login:**
   Use the default admin credentials (or those set in your `.env` file):

   - Username: admin
   - Password: password

## API Endpoints

### Authentication

- `GET /login` - Login page
- `POST /login` - Authenticate user
- `POST /logout` - Logout user

### Dashboard

- `GET /` - Main dashboard with user statistics

### User Management

- `GET /users` - List all users with search, filter, pagination, and sorting
- `GET /users/:id` - View user details
- `GET /add` - Add new user form
- `POST /add` - Create new user
- `PUT /update/:id` - Update user
- `POST /delete/:id` - Delete user
- `POST /users/bulk-delete` - Bulk delete users

### Data Operations

- `GET /export` - Export users to CSV
- `POST /upload` - Import users from CSV
- `GET /user/:id` - Get user data (JSON)

### Utilities

- `GET /proxy` - Proxy tester page
- `GET /proxy/:url` - Make proxy request

## Database Schema

The application uses a single `users` table with the following structure:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  deletedAt DATETIME NULL
);
```

## Development

### Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reloading
- `npm run build:css` - Build TailwindCSS styles
- `npm run dev:css` - Watch and build CSS in development mode

### Project Structure

```
crud-app/
├── models/
│   └── User.js          # User model definition
├── public/
│   ├── input.css        # TailwindCSS input
│   ├── output.css       # Compiled CSS
│   └── style.css        # Additional styles
├── uploads/             # File upload directory
├── views/               # EJS templates
│   ├── index.ejs        # Dashboard
│   ├── users.ejs        # User list
│   ├── add.ejs          # Add user form
│   ├── login.ejs        # Login page
│   └── ...
├── sequelize.js         # Database configuration
├── server.js            # Main application file
├── package.json         # Dependencies and scripts
└── README.md            # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the package.json file for details.

## Security Notes

- Change default admin credentials in production
- Use strong SESSION_SECRET
- Validate all user inputs
- Keep dependencies updated
- Use HTTPS in production

## Support

For support or questions, please open an issue in the repository.

--Developed by Anurag
