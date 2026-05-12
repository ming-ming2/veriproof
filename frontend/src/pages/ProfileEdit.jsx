import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} from "../api/profile";

export default function ProfileEdit() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await getProfile();
        if (!cancelled) {
          setProfile(res.data);
          setName(res.data.name || "");
          setAffiliation(res.data.affiliation || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "프로필을 불러오지 못했습니다."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const { data: res } = await updateProfile({ name, affiliation });
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({ ...stored, name, affiliation })
      );
      setProfile(res.data || { ...profile, name, affiliation });
      setProfileMsg("저장되었습니다.");
      setTimeout(() => setProfileMsg(""), 2000);
    } catch (err) {
      setProfileMsg(
        err.response?.data?.error?.message || "저장에 실패했습니다."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg("");

    // 프런트 검증
    if (!currentPassword) {
      setPasswordMsg("현재 비밀번호를 입력해주세요.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordMsg("새 비밀번호는 현재 비밀번호와 달라야 합니다.");
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("비밀번호가 변경되었습니다.");
      setTimeout(() => setPasswordMsg(""), 2000);
    } catch (err) {
      setPasswordMsg(
        err.response?.data?.error?.message ||
          "비밀번호 변경에 실패했습니다."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    } catch (err) {
      alert(
        err.response?.data?.error?.message || "계정 탈퇴에 실패했습니다."
      );
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <span style={styles.navTitle}>시험 플랫폼</span>
        </nav>
        <div style={styles.loadingText}>불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <span style={styles.navTitle}>시험 플랫폼</span>
        </nav>
        <div style={styles.content}>
          <p style={styles.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>시험 플랫폼</span>
        <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>
          대시보드로
        </button>
      </nav>

      <div style={styles.content}>
        <h1 style={styles.pageTitle}>계정 설정</h1>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>계정 정보</h2>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>아이디</label>
            <div style={styles.readOnlyField}>{profile?.username || "-"}</div>
            <p style={styles.helpText}>아이디는 변경할 수 없습니다.</p>
          </div>
        </section>

        <hr style={styles.divider} />

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>기본 정보</h2>
          <form onSubmit={handleSaveProfile}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>소속</label>
              <input
                type="text"
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                placeholder="예: 컴퓨터공학과"
                style={styles.input}
              />
            </div>
            <div style={styles.formFooter}>
              {profileMsg && (
                <span
                  style={{
                    ...styles.formMsg,
                    color: profileMsg.includes("저장")
                      ? "#185FA5"
                      : "#c0392b",
                  }}
                >
                  {profileMsg}
                </span>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                style={{
                  ...styles.saveBtn,
                  opacity: savingProfile ? 0.6 : 1,
                }}
              >
                {savingProfile ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </section>

        <hr style={styles.divider} />

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>비밀번호 변경</h2>
          <form onSubmit={handleChangePassword}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>현재 비밀번호</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8자 이상"
                style={styles.input}
              />
              <p style={styles.helpText}>8자 이상으로 입력해주세요.</p>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>새 비밀번호 확인</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.formFooter}>
              {passwordMsg && (
                <span
                  style={{
                    ...styles.formMsg,
                    color: passwordMsg.includes("변경되었")
                      ? "#185FA5"
                      : "#c0392b",
                  }}
                >
                  {passwordMsg}
                </span>
              )}
              <button
                type="submit"
                disabled={savingPassword}
                style={{
                  ...styles.saveBtn,
                  opacity: savingPassword ? 0.6 : 1,
                }}
              >
                {savingPassword ? "변경 중..." : "비밀번호 변경"}
              </button>
            </div>
          </form>
        </section>

        <hr style={styles.divider} />

        <section style={styles.section}>
          <h2 style={{ ...styles.sectionTitle, color: "#c0392b" }}>
            계정 탈퇴
          </h2>
          <p style={styles.dangerText}>
            탈퇴하면 계정 정보와 개설한 모든 시험이 삭제되며 복구할 수 없습니다.
          </p>
          <button
            style={styles.dangerBtn}
            onClick={() => setShowDeleteModal(true)}
          >
            계정 탈퇴
          </button>
        </section>
      </div>

      {showDeleteModal && (
        <div
          style={styles.modalBackdrop}
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>정말 탈퇴하시겠습니까?</h3>
            <p style={styles.modalText}>
              탈퇴를 진행하려면 비밀번호를 한 번 더 입력해주세요.
            </p>
            <input
              type="password"
              placeholder="비밀번호"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              style={styles.input}
            />
            <div style={{ ...styles.modalActions, marginTop: 16 }}>
              <button
                style={styles.modalCancelBtn}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                }}
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                style={styles.modalDeleteBtn}
                onClick={handleDeleteAccount}
                disabled={isDeleting || !deletePassword}
              >
                {isDeleting ? "처리 중..." : "탈퇴"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f7f8",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    borderBottom: "1px solid #e5e5e5",
    background: "#fff",
  },
  navTitle: { fontSize: 16, fontWeight: 500 },
  backBtn: {
    fontSize: 12,
    padding: "6px 14px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
  },

  content: { maxWidth: 560, margin: "0 auto", padding: "32px 20px" },
  loadingText: { fontSize: 14, color: "#999", textAlign: "center", padding: 60 },
  errorText: {
    fontSize: 14,
    color: "#c0392b",
    textAlign: "center",
    padding: 40,
  },
  pageTitle: { fontSize: 22, fontWeight: 500, marginBottom: 24 },

  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 500, margin: "0 0 14px" },
  divider: { border: "none", borderTop: "1px solid #e5e5e5", margin: "24px 0" },

  fieldGroup: { marginBottom: 14 },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 5,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
  },
  readOnlyField: {
    padding: "8px 12px",
    fontSize: 14,
    background: "#f0f0f0",
    borderRadius: 8,
    color: "#666",
  },
  helpText: { fontSize: 12, color: "#888", marginTop: 4 },

  formFooter: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  formMsg: { fontSize: 13 },
  saveBtn: {
    padding: "8px 18px",
    fontSize: 13,
    border: "none",
    borderRadius: 8,
    background: "#185FA5",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },

  dangerText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.6,
    margin: "0 0 12px",
  },
  dangerBtn: {
    padding: "8px 18px",
    fontSize: 13,
    border: "1px solid #e24b4a",
    borderRadius: 8,
    background: "#fff",
    color: "#e24b4a",
    cursor: "pointer",
    fontWeight: 500,
  },

  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: "24px 28px",
    width: "90%",
    maxWidth: 420,
    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
  },
  modalTitle: { fontSize: 17, fontWeight: 500, margin: "0 0 8px" },
  modalText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.6,
    margin: "0 0 16px",
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 8 },
  modalCancelBtn: {
    fontSize: 13,
    padding: "8px 18px",
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
    fontWeight: 500,
  },
  modalDeleteBtn: {
    fontSize: 13,
    padding: "8px 18px",
    border: "none",
    borderRadius: 8,
    background: "#e24b4a",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
};
