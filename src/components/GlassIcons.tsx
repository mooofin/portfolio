interface GlassIconsProps {
  skills: string[];
}

const GlassIcons = ({ skills }: GlassIconsProps) => {
  return (
    <div className="glass-icons-container">
      {skills.map((skill, index) => (
        <div
          key={skill}
          className="glass-icon"
          style={
            {
              "--delay": `${index * 0.1}s`,
              "--hue": `${(index * 60) % 360}`,
            } as React.CSSProperties
          }
        >
          <div className="glass-icon-content">
            <div className="glass-icon-inner">
              <span className="glass-icon-text">{skill}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GlassIcons;
