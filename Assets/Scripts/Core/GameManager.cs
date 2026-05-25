using UnityEngine;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    public PlayerData Player { get; private set; }
    public BusinessManager BusinessManager { get; private set; }
    public SkillSystem SkillSystem { get; private set; }

    [SerializeField] private float autoSaveInterval = 60f;
    private float _autoSaveTimer;

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        Player = GetComponent<PlayerData>();
        BusinessManager = GetComponent<BusinessManager>();
        SkillSystem = GetComponent<SkillSystem>();

        SaveSystem.Load(Player, BusinessManager, SkillSystem);
    }

    void Update()
    {
        _autoSaveTimer += Time.deltaTime;
        if (_autoSaveTimer >= autoSaveInterval)
        {
            _autoSaveTimer = 0f;
            SaveSystem.Save(Player, BusinessManager, SkillSystem);
        }
    }

    public void NewGame(string playerName)
    {
        Player.Initialize(playerName);
        SkillSystem.Initialize();
        BusinessManager.Initialize();
        SaveSystem.Save(Player, BusinessManager, SkillSystem);
        SceneManager.LoadScene("GameScene");
    }

    public void LoadMainMenu()
    {
        SaveSystem.Save(Player, BusinessManager, SkillSystem);
        SceneManager.LoadScene("MainMenu");
    }

    void OnApplicationPause(bool paused)
    {
        if (paused)
            SaveSystem.Save(Player, BusinessManager, SkillSystem);
    }

    void OnApplicationQuit()
    {
        SaveSystem.Save(Player, BusinessManager, SkillSystem);
    }
}
