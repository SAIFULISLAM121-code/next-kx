import "./globals.css";

export const metadata = {
  title: "Classroom | Student Attendance",
  description: "Manage your students and track daily attendance.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
