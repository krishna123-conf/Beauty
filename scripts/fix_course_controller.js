#!/usr/bin/env node

/**
 * Script to fix course controller to work with mock data when Firebase is not configured
 */

const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, '../backend/controllers/courseController.js');
let content = fs.readFileSync(controllerPath, 'utf8');

// Function to replace Firebase-dependent functions with mock data fallbacks
const fixes = [
    {
        // getLiveCoursesByCategory
        search: /const getLiveCoursesByCategory = async \(req, res\) => \{[\s\S]*?if \(!db\) \{[\s\S]*?\}\s*\n/,
        replace: `const getLiveCoursesByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const db = getFirestore();
        
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log(\`📝 Using mock data for getLiveCoursesByCategory: \${category}\`);
            const courses = Array.from(mockCourses.values())
                .filter(course => course.category === category)
                .map(course => addDurationToCourse(course));
            return res.status(200).json({
                success: true,
                data: courses,
                count: courses.length,
                category: category,
                message: 'Live courses retrieved from mock data'
            });
        }

`
    },
    {
        // getLiveCoursesByInstructor
        search: /const getLiveCoursesByInstructor = async \(req, res\) => \{[\s\S]*?if \(!db\) \{[\s\S]*?\}\s*\n/,
        replace: `const getLiveCoursesByInstructor = async (req, res) => {
    try {
        const { instructorId } = req.params;
        const db = getFirestore();
        
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log(\`📝 Using mock data for getLiveCoursesByInstructor: \${instructorId}\`);
            const courses = Array.from(mockCourses.values())
                .filter(course => course.instructorId === instructorId)
                .map(course => addDurationToCourse(course));
            return res.status(200).json({
                success: true,
                data: courses,
                count: courses.length,
                instructorId: instructorId,
                message: 'Live courses retrieved from mock data'
            });
        }

`
    },
    {
        // getLiveCoursesByStatus
        search: /const getLiveCoursesByStatus = async \(req, res\) => \{[\s\S]*?if \(!db\) \{[\s\S]*?\}\s*\n/,
        replace: `const getLiveCoursesByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const db = getFirestore();
        
        if (!db) {
            // Use mock data when Firebase is not configured
            console.log(\`📝 Using mock data for getLiveCoursesByStatus: \${status}\`);
            const courses = Array.from(mockCourses.values())
                .filter(course => course.status === status)
                .map(course => addDurationToCourse(course));
            return res.status(200).json({
                success: true,
                data: courses,
                count: courses.length,
                status: status,
                message: 'Live courses retrieved from mock data'
            });
        }

`
    }
];

// Apply fixes
fixes.forEach((fix, index) => {
    if (fix.search.test(content)) {
        content = content.replace(fix.search, fix.replace);
        console.log(`✅ Applied fix ${index + 1}`);
    } else {
        console.log(`⚠️  Could not apply fix ${index + 1} - pattern not found`);
    }
});

// Write back the file
fs.writeFileSync(controllerPath, content);
console.log('✅ Course controller updated successfully');