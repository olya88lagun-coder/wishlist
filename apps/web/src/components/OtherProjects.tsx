import { OTHER_PROJECTS, otherProjectUrl, type OtherProjectPlacement } from "@/content/other-projects";
import "./other-projects.css";

export function OtherProjects({ placement }: { placement: Exclude<OtherProjectPlacement, "footer"> }) {
  return (
    <section className="other-projects" aria-labelledby={`other-projects-${placement}`}>
      <h2 id={`other-projects-${placement}`} className="other-projects__title">Другие проекты автора</h2>
      <ul className="other-projects__list">
        {OTHER_PROJECTS.map((project) => (
          <li key={project.id}>
            <a href={otherProjectUrl(project, placement)} target="_blank" rel="noopener noreferrer">
              <span className="other-projects__name">{project.name}</span>
              <span className="other-projects__summary">{project.summary}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
