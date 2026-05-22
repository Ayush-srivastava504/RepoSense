'use client';

import { useState } from 'react';

import { api } from '@/lib/api';

export default function ResumeBuilder() {

  const [resumeType, setResumeType] =
    useState('internship');

  const [jobDescription, setJobDescription] =
    useState('');

  const [skills, setSkills] =
    useState('');

  const [experience, setExperience] =
    useState('');

  const [generatedResume, setGeneratedResume] =
    useState('');

  const [title, setTitle] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const generateResume = async () => {

    if (!jobDescription.trim()) {

      alert(
        'Paste job description first'
      );

      return;
    }

    setLoading(true);

    try {

      const response = await api.post(
        '/resume/generate',
        {
          resume_type: resumeType,
          job_description: jobDescription,
          skills,
          experience,
        }
      );

      setGeneratedResume(
        response.resume || ''
      );

    } catch (err) {

      console.error(err);

      alert(
        'Resume generation failed'
      );

    } finally {

      setLoading(false);

    }
  };

  const saveResume = async () => {

    if (!title.trim()) {

      alert(
        'Enter resume title'
      );

      return;
    }

    if (!generatedResume.trim()) {

      alert(
        'Generate resume first'
      );

      return;
    }

    setSaving(true);

    try {

      await api.post(
        '/resume/create',
        {
          title,
          content: generatedResume,
        }
      );

      alert(
        'Resume saved successfully'
      );

    } catch (err) {

      console.error(err);

      alert(
        'Save failed'
      );

    } finally {

      setSaving(false);

    }
  };

  const downloadResume = () => {

    if (!generatedResume) {
      return;
    }

    const blob = new Blob(
      [generatedResume],
      {
        type: 'text/plain',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;

    a.download =
      `${title || 'resume'}.txt`;

    a.click();

    URL.revokeObjectURL(url);
  };

  return (

    <div className="container mx-auto p-6 max-w-6xl">

      <h1 className="text-4xl font-bold mb-6">
        AI Resume Builder
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="space-y-4">

          <input
            type="text"
            placeholder="Resume Title"
            value={title}
            onChange={(e) =>
              setTitle(
                e.target.value
              )
            }
            className="w-full border p-3 rounded"
          />

          <select
            value={resumeType}
            onChange={(e) =>
              setResumeType(
                e.target.value
              )
            }
            className="w-full border p-3 rounded"
          >

            <option value="internship">
              Internship Resume
            </option>

            <option value="full-time">
              Full-Time Resume
            </option>

          </select>

          <textarea
            placeholder="Paste complete job description..."
            value={jobDescription}
            onChange={(e) =>
              setJobDescription(
                e.target.value
              )
            }
            className="w-full h-64 border p-3 rounded"
          />

          <textarea
            placeholder="Skills (Python, FastAPI, React, SQL...)"
            value={skills}
            onChange={(e) =>
              setSkills(
                e.target.value
              )
            }
            className="w-full h-32 border p-3 rounded"
          />

          <textarea
            placeholder="Experience / projects / internships..."
            value={experience}
            onChange={(e) =>
              setExperience(
                e.target.value
              )
            }
            className="w-full h-48 border p-3 rounded"
          />

          <div className="flex gap-3">

            <button
              onClick={generateResume}
              disabled={loading}
              className="bg-purple-600 text-white px-5 py-3 rounded"
            >

              {
                loading
                  ? 'Generating...'
                  : 'Generate Resume'
              }

            </button>

            <button
              onClick={saveResume}
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-3 rounded"
            >

              {
                saving
                  ? 'Saving...'
                  : 'Save Resume'
              }

            </button>

            <button
              onClick={downloadResume}
              className="bg-green-600 text-white px-5 py-3 rounded"
            >
              Download
            </button>

          </div>

        </div>

        <div>

          <textarea
            value={generatedResume}
            onChange={(e) =>
              setGeneratedResume(
                e.target.value
              )
            }
            className="w-full h-[900px] border p-4 rounded font-mono text-sm"
          />

        </div>

      </div>

    </div>
  );
}