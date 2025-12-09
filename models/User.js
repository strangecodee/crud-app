import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value) {
        this.setDataValue("email", value.trim().toLowerCase());
      },
    },
    deletedAt: {
      // <-- REQUIRED FOR POSTGRES WHEN paranoid:true
      type: DataTypes.DATE,
    },
  },
  {
    timestamps: true,
    paranoid: true,
    tableName: "users",
  }
);

export default User;
